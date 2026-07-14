"""Register the MIR models in Azure ML and serve them as Managed Online Endpoints.

The "upgrade path" from baked-into-worker-images to AML-served (ARCHITECTURE.md §4.5).
Real azure-ai-ml SDK v2 — runs against your workspace:

    pip install azure-ai-ml azure-identity
    export AML_SUBSCRIPTION=... AML_RESOURCE_GROUP=... AML_WORKSPACE=...
    python register_and_deploy.py --model basic-pitch

After this, point the worker at the endpoint (AML_TRANSCRIBE_ENDPOINT / _KEY) and it
becomes a thin orchestrator that calls AML instead of running inference in-pod.
"""
from __future__ import annotations

import argparse
import os

from azure.ai.ml import MLClient
from azure.ai.ml.entities import (
    Environment, ManagedOnlineDeployment, ManagedOnlineEndpoint, Model, CodeConfiguration,
)
from azure.ai.ml.constants import AssetTypes
from azure.identity import DefaultAzureCredential

# model → (endpoint name, GPU instance type). Heavy models land on A10G, light on T4.
MODELS = {
    "basic-pitch": ("violahub-transcribe", "Standard_NV36ads_A10_v5"),
    "oemer":       ("violahub-omr",        "Standard_NV36ads_A10_v5"),
    "crepe":       ("violahub-pitch",      "Standard_NC4as_T4_v3"),
}


def client() -> MLClient:
    return MLClient(
        DefaultAzureCredential(),
        os.environ["AML_SUBSCRIPTION"],
        os.environ["AML_RESOURCE_GROUP"],
        os.environ["AML_WORKSPACE"],
    )


def deploy(model_name: str) -> None:
    endpoint_name, instance_type = MODELS[model_name]
    ml = client()

    # 1. Register the model (weights are pulled by the environment's pip install;
    #    the registered asset versions the served code + conda spec).
    model = ml.models.create_or_update(Model(
        name=model_name, type=AssetTypes.CUSTOM_MODEL, path="./artifacts",
        description=f"ViolaHub MIR model: {model_name}",
    ))

    # 2. Environment: a CUDA base + the model's pip deps.
    env = Environment(
        name=f"{model_name}-env",
        image="mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu22.04",
        conda_file="conda.yaml",
    )

    # 3. Endpoint + deployment running score.py.
    ml.online_endpoints.begin_create_or_update(
        ManagedOnlineEndpoint(name=endpoint_name, auth_mode="key")
    ).result()

    deployment = ManagedOnlineDeployment(
        name="blue",
        endpoint_name=endpoint_name,
        model=model,
        environment=env,
        code_configuration=CodeConfiguration(code="./", scoring_script="score.py"),
        instance_type=instance_type,
        instance_count=1,
        environment_variables={"VIOLAHUB_MODEL": model_name},
    )
    ml.online_deployments.begin_create_or_update(deployment).result()

    ep = ml.online_endpoints.get(endpoint_name)
    ep.traffic = {"blue": 100}
    ml.online_endpoints.begin_create_or_update(ep).result()
    print(f"[aml] {model_name} live at {endpoint_name} ({instance_type})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=list(MODELS))
    deploy(ap.parse_args().model)
