// ViolaHub — LAUNCH deploy on Azure Container Apps (leaner than the full AKS/AML
// topology in ../main.bicep). API + worker scale to zero; worker runs the real
// models on CPU (slower than GPU, but real). Move the worker to the AKS GPU pool
// (../main.bicep) when volume justifies it — same images.
//
//   az group create -n violahub-rg -l eastus
//   az deployment group create -g violahub-rg -f main.bicep -p pgPassword=... jwtSecret=...
//   (then build+push images and update the container apps — see deploy.md)

@description('Short resource name prefix.')
param prefix string = 'violahub'
param location string = resourceGroup().location
@secure()
@description('Postgres ADMIN password (schema setup only).')
param pgPassword string
@secure()
@description('Password for the non-owner app role the API/worker connect as (RLS-enforced).')
param appPassword string
@secure()
@description('Signing secret for self-issued JWTs (auth).')
param jwtSecret string
@description('Container image tag to deploy (after az acr build).')
param imageTag string = 'latest'

var uniq = uniqueString(resourceGroup().id)
var acrName = toLower('${prefix}${uniq}')

// ── identity used by both apps to reach Blob / Service Bus / ACR ─────────────
resource mi 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-mi'
  location: location
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: acrName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: { minimumTlsVersion: 'TLS1_2', allowBlobPublicAccess: false, allowSharedKeyAccess: false }
}
resource blob 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = { parent: storage, name: 'default' }
resource recordings 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blob
  name: 'recordings'
  properties: { publicAccess: 'None' }
}

resource sb 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '${prefix}-${uniq}'
  location: location
  sku: { name: 'Standard', tier: 'Standard' }
}
resource topicStd 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = { parent: sb, name: 'analyze-standard' }
resource subStd 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topicStd, name: 'workers', properties: { maxDeliveryCount: 5, deadLetteringOnMessageExpiration: true }
}
resource topicHeavy 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = { parent: sb, name: 'analyze-heavy' }
resource subHeavy 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topicHeavy, name: 'workers', properties: { maxDeliveryCount: 5 }
}

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '${prefix}-${uniq}'
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: 'violahub'
    administratorLoginPassword: pgPassword
    storage: { storageSizeGB: 32 }
    highAvailability: { mode: 'Disabled' }
  }
}
resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = { parent: pg, name: 'violahub' }
// Allow Azure services (Container Apps) to reach Postgres. Tighten to VNet for prod.
resource pgFw 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: pg, name: 'AllowAzure', properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

// ── role assignments for the identity ───────────────────────────────────────
var roles = {
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  blobContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  sbDataOwner: '090c5cfd-751d-490a-894a-3ce6f1109419'
}
resource raAcr 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, mi.id, roles.acrPull)
  scope: acr
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPull), principalId: mi.properties.principalId, principalType: 'ServicePrincipal' }
}
resource raBlob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, mi.id, roles.blobContributor)
  scope: storage
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.blobContributor), principalId: mi.properties.principalId, principalType: 'ServicePrincipal' }
}
resource raSb 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(sb.id, mi.id, roles.sbDataOwner)
  scope: sb
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.sbDataOwner), principalId: mi.properties.principalId, principalType: 'ServicePrincipal' }
}

// ── Container Apps environment ───────────────────────────────────────────────
resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${prefix}-logs'
  location: location
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}
resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: { customerId: logs.properties.customerId, sharedKey: logs.listKeys().primarySharedKey }
    }
  }
}

// Connect as the NON-OWNER app role so RLS is enforced (owner/admin bypasses RLS).
// Create this role with db/roles.sql after the schema is applied (see deploy.md).
var dbUrl = 'postgresql://violahub_app:${appPassword}@${pg.properties.fullyQualifiedDomainName}:5432/violahub'
var sbNs = '${sb.name}.servicebus.windows.net'
var miConfig = { type: 'UserAssigned', userAssignedIdentities: { '${mi.id}': {} } }
var registries = [ { server: acr.properties.loginServer, identity: mi.id } ]

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-api'
  location: location
  identity: miConfig
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      registries: registries
      secrets: [ { name: 'db-url', value: dbUrl }, { name: 'jwt-secret', value: jwtSecret } ]
      ingress: { external: true, targetPort: 8000, transport: 'auto' }
    }
    template: {
      containers: [ {
        name: 'api'
        image: '${acr.properties.loginServer}/violahub-api:${imageTag}'
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'AZURE_CLIENT_ID', value: mi.properties.clientId }
          { name: 'VIOLAHUB_DATABASE_URL', secretRef: 'db-url' }
          { name: 'VIOLAHUB_JWT_DEV_SECRET', secretRef: 'jwt-secret' }
          { name: 'VIOLAHUB_STORAGE_ACCOUNT', value: storage.name }
          { name: 'VIOLAHUB_SERVICEBUS_NAMESPACE', value: sbNs }
        ]
      } ]
      scale: { minReplicas: 1, maxReplicas: 4 }
    }
  }
}

resource worker 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-worker'
  location: location
  identity: miConfig
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      registries: registries
      secrets: [ { name: 'db-url', value: dbUrl } ]
      activeRevisionsMode: 'Single'
    }
    template: {
      containers: [ {
        name: 'worker'
        image: '${acr.properties.loginServer}/violahub-worker:${imageTag}'
        resources: { cpu: json('2.0'), memory: '4Gi' }
        env: [
          { name: 'AZURE_CLIENT_ID', value: mi.properties.clientId }
          { name: 'DATABASE_URL', secretRef: 'db-url' }
          { name: 'SERVICEBUS_NAMESPACE', value: sbNs }
          { name: 'SERVICEBUS_TOPIC', value: 'analyze-standard' }
          { name: 'SERVICEBUS_SUBSCRIPTION', value: 'workers' }
        ]
      } ]
      scale: {
        minReplicas: 0
        maxReplicas: 5
        rules: [ {
          name: 'servicebus'
          custom: {
            type: 'azure-servicebus'
            metadata: { topicName: 'analyze-standard', subscriptionName: 'workers', namespace: sb.name, messageCount: '5' }
            identity: mi.id
          }
        } ]
      }
    }
  }
}

output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
output acrLoginServer string = acr.properties.loginServer
output storageAccount string = storage.name
output serviceBusNamespace string = sbNs
output pgHost string = pg.properties.fullyQualifiedDomainName
