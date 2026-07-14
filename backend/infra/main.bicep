// ViolaHub Azure infrastructure (ARCHITECTURE.md §3). Deploy at resource-group scope:
//   az deployment group create -g violahub-rg -f main.bicep -p prefix=violahub
// Representative topology — tune SKUs/quotas for your environment.

@description('Short name prefix for resources (also the storage/account stem).')
param prefix string = 'violahub'

@description('Azure region.')
param location string = resourceGroup().location

@description('PostgreSQL admin login.')
param pgAdmin string = 'violahub'

@secure()
@description('PostgreSQL admin password.')
param pgPassword string

var uniq = uniqueString(resourceGroup().id)

// ── Storage: recordings (Premium block blob) ────────────────────────────────
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: toLower('${prefix}${uniq}')
  location: location
  sku: { name: 'Premium_LRS' }
  kind: 'BlockBlobStorage'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false // force AAD / User Delegation SAS only
  }
}
resource blobSvc 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}
resource recordingsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobSvc
  name: 'recordings'
  properties: { publicAccess: 'None' }
}

// ── Service Bus: analyze jobs ───────────────────────────────────────────────
resource sb 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '${prefix}-${uniq}'
  location: location
  sku: { name: 'Standard', tier: 'Standard' }
}
resource sbTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = {
  parent: sb
  name: 'recordings'
  properties: { enablePartitioning: false }
}
resource sbSub 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: sbTopic
  name: 'workers'
  properties: { maxDeliveryCount: 5, deadLetteringOnMessageExpiration: true }
}

// ── PostgreSQL Flexible Server ──────────────────────────────────────────────
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '${prefix}-${uniq}'
  location: location
  sku: { name: 'Standard_D2ds_v5', tier: 'GeneralPurpose' }
  properties: {
    version: '16'
    administratorLogin: pgAdmin
    administratorLoginPassword: pgPassword
    storage: { storageSizeGB: 32 }
    highAvailability: { mode: 'ZoneRedundant' }
  }
}
resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: pg
  name: 'violahub'
}

// ── Web PubSub: push completion events ──────────────────────────────────────
resource pubsub 'Microsoft.SignalRService/webPubSub@2023-08-01-preview' = {
  name: '${prefix}-${uniq}'
  location: location
  sku: { name: 'Standard_S1', tier: 'Standard', capacity: 1 }
}
resource pubsubHub 'Microsoft.SignalRService/webPubSub/hubs@2023-08-01-preview' = {
  parent: pubsub
  name: 'violahub'
  properties: { anonymousConnectPolicy: 'deny' }
}

// ── Container registry ──────────────────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: toLower('${prefix}${uniq}')
  location: location
  sku: { name: 'Standard' }
  properties: { adminUserEnabled: false }
}

// ── AKS with a GPU (T4) node pool for the worker ────────────────────────────
resource aks 'Microsoft.ContainerService/managedClusters@2024-02-01' = {
  name: '${prefix}-${uniq}'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    dnsPrefix: '${prefix}${uniq}'
    enableRBAC: true
    workloadAutoScalerProfile: { keda: { enabled: true } }
    oidcIssuerProfile: { enabled: true }
    securityProfile: { workloadIdentity: { enabled: true } }
    agentPoolProfiles: [
      {
        name: 'system'
        mode: 'System'
        count: 2
        vmSize: 'Standard_D2s_v5'
        osType: 'Linux'
      }
      {
        name: 'gpu'
        mode: 'User'
        count: 0
        minCount: 0
        maxCount: 6
        enableAutoScaling: true
        vmSize: 'Standard_NC4as_T4_v3' // NVIDIA T4
        osType: 'Linux'
        nodeLabels: { workload: 'gpu' }
        nodeTaints: [ 'sku=gpu:NoSchedule' ]
      }
    ]
  }
}

output storageAccount string = storage.name
output serviceBusNamespace string = '${sb.name}.servicebus.windows.net'
output webPubSubEndpoint string = 'https://${pubsub.name}.webpubsub.azure.com'
output acrLoginServer string = acr.properties.loginServer
output aksName string = aks.name
output pgHost string = pg.properties.fullyQualifiedDomainName
