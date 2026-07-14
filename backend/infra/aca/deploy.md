# Deploy ViolaHub to Azure (launch)

Gets ViolaHub live and reachable by URL — **browser-based, nothing installed**.
Uses Azure Container Apps (API + worker, scale-to-zero), PostgreSQL Flexible
Server, Blob Storage, Service Bus, and Static Web Apps for the frontend. The full
AKS/GPU topology (`../main.bicep`) is the scale-up path; this is the get-it-live path.

Prereqs: `az` CLI (logged in), `docker`, `psql`, Node 20. Run from `backend/infra/aca`.

```bash
RG=violahub-rg; LOC=eastus
PG_PW='<strong-admin-pw>'; APP_PW='<strong-app-pw>'; JWT='<random-32+ chars>'

az group create -n $RG -l $LOC
```

## 1. Provision infrastructure

```bash
az deployment group create -g $RG -f main.bicep \
  -p pgPassword="$PG_PW" appPassword="$APP_PW" jwtSecret="$JWT"

# capture outputs
ACR=$(az deployment group show -g $RG -n main --query properties.outputs.acrLoginServer.value -o tsv)
API_URL=$(az deployment group show -g $RG -n main --query properties.outputs.apiUrl.value -o tsv)
PGHOST=$(az deployment group show -g $RG -n main --query properties.outputs.pgHost.value -o tsv)
```

(The container apps come up before the images exist — that's fine, they retry.)

## 2. Build & push the images (real models baked into the worker)

```bash
REGISTRY=${ACR%%.*}
az acr build --registry $REGISTRY --image violahub-api:latest    ../../api
az acr build --registry $REGISTRY --image violahub-worker:latest ../../worker   # runs fetch_models
# roll the apps onto the new images
az containerapp update -g $RG -n violahub-api    --image $ACR/violahub-api:latest
az containerapp update -g $RG -n violahub-worker --image $ACR/violahub-worker:latest
```

## 3. Apply the database schema + create the non-owner app role

```bash
# open your IP to Postgres temporarily
MYIP=$(curl -s ifconfig.me)
az postgres flexible-server firewall-rule create -g $RG -n ${PGHOST%%.*} \
  --rule-name myip --start-ip-address $MYIP --end-ip-address $MYIP

ADMIN_URL="postgresql://violahub:$PG_PW@$PGHOST:5432/violahub?sslmode=require"
psql "$ADMIN_URL" -f ../../db/schema.sql
psql "$ADMIN_URL" -f ../../db/rls.sql
psql "$ADMIN_URL" -v app_pw="'$APP_PW'" -f ../../db/roles.sql   # RLS-enforced app role
```

## 4. Lock CORS to the frontend origin (after step 5 gives you the URL)

```bash
az containerapp update -g $RG -n violahub-api \
  --set-env-vars VIOLAHUB_CORS_ORIGINS="https://<your-swa>.azurestaticapps.net"
```

## 5. Deploy the frontend (Static Web App)

```bash
cd ../../../app
echo "VITE_API_BASE=$API_URL" > .env.production
npm ci && npm run build
az staticwebapp create -n violahub-web -g $RG -l $LOC
TOKEN=$(az staticwebapp secrets list -n violahub-web -g $RG --query properties.apiKey -o tsv)
npx @azure/static-web-apps-cli deploy ./dist --deployment-token "$TOKEN" --env production
```

Open the Static Web App URL → register a **teacher** account → you're live.

## Notes
- **Worker on CPU** here (real, just slower). Move to the AKS GPU pool (`../main.bicep`)
  when volume grows — same images.
- **Web PubSub** (real-time result push) is optional; without it the client polls
  `GET /recordings/{id}`. Add it and set `VIOLAHUB_WEBPUBSUB_ENDPOINT` to enable push.
- Tighten the Postgres firewall (remove `AllowAzure`/your IP, use VNet) before real use.
- Rotate `JWT`/passwords via Key Vault in production.
