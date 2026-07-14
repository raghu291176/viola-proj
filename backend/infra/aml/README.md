# AML model hosting (upgrade path)

The "upgradeable later" hosting mode from `docs/ARCHITECTURE.md` §4.5. Same real
models as the baked-into-worker images — just served by **Azure ML Managed Online
Endpoints** instead of running inside the AKS pod, giving versioning, canary/A-B,
and independent scaling.

## Deploy

```bash
pip install azure-ai-ml azure-identity
export AML_SUBSCRIPTION=... AML_RESOURCE_GROUP=... AML_WORKSPACE=...
python register_and_deploy.py --model basic-pitch    # transcription (A10G)
python register_and_deploy.py --model oemer           # OMR (A10G)
python register_and_deploy.py --model crepe           # pitch (T4)
```

`register_and_deploy.py` registers the model, builds the environment from
`conda.yaml`, and serves `score.py` behind a keyed managed endpoint.

## Switch the worker to thin-orchestrator mode

Point the worker at the endpoints and it calls AML instead of running inference
locally (`worker/aml_client.py`):

```
AML_TRANSCRIBE_ENDPOINT=https://violahub-transcribe.<region>.inference.ml.azure.com/score
AML_TRANSCRIBE_KEY=<endpoint key>
AML_OMR_ENDPOINT=...   AML_OMR_KEY=...
```

Unset → the worker uses the models baked into its image (the launch default).
Identical model math either way.
