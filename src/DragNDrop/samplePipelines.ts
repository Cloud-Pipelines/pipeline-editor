/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import { ComponentSpec } from "../componentSpec";
import { downloadComponentDataWithCache } from "../github";

const TFX_PIPELINE_URL = "https://raw.githubusercontent.com/Ark-kun/pipelines/2765b13699ac28de523f499eeaa9eb2ed9b8798a/components/deprecated/tfx/_samples/TFX.pipeline.component.yaml"
const XGBOOST_PIPELINE_URL = "https://raw.githubusercontent.com/Ark-kun/pipelines/2edfd25b5ee3a4aa149c24a225a50041fbd3662d/components/XGBoost/_samples/sample_pipeline.pipeline.component.yaml"
const PYTORCH_PIPELINE_URL = "https://raw.githubusercontent.com/Ark-kun/pipelines/237cd6bc0b6db26f615c22897be20aad77270b50/components/PyTorch/_samples/Train_fully-connected_network.pipeline.component.yaml"
const VERTEX_AI_AUTOML_TABLES_PIPELINE_URL = "https://raw.githubusercontent.com/Ark-kun/pipeline_components/44b0543525ab6149ce995a411f88997e7131a53d/components/google-cloud/Vertex_AI/AutoML/Tables/_samples/VertexAI.AutoML.Tables.pipeline.component.yaml"

export const PRELOADED_PIPELINE_URLS = [
  XGBOOST_PIPELINE_URL,
  PYTORCH_PIPELINE_URL,
  VERTEX_AI_AUTOML_TABLES_PIPELINE_URL,
  TFX_PIPELINE_URL,
];

const preloadComponentReferences = async (
  componentSpec: ComponentSpec,
  componentMap?: Map<string, ComponentSpec>
) => {
  // This map is needed to improve efficiency and handle recursive components.
  if (componentMap === undefined) {
    componentMap = new Map<string, ComponentSpec>();
  }
  if ("graph" in componentSpec.implementation) {
    for (const taskSpec of Object.values(
      componentSpec.implementation.graph.tasks
    )) {
      const componentUrl = taskSpec.componentRef.url;
      if (
        taskSpec.componentRef.spec === undefined &&
        componentUrl !== undefined
      ) {
        let taskComponentSpec = componentMap.get(componentUrl);
        if (taskComponentSpec === undefined) {
          taskComponentSpec = await downloadComponentDataWithCache(
            componentUrl
          );
          componentMap.set(componentUrl, taskComponentSpec);
        }
        taskSpec.componentRef.spec = taskComponentSpec;
        await preloadComponentReferences(taskComponentSpec, componentMap);
      }
    }
  }
  return componentSpec;
};

const loadComponentFromUrl = async (
  url: string,
  preloadChildComponentSpecs = true
) => {
  let componentSpec = await downloadComponentDataWithCache(url);
  if (preloadChildComponentSpecs) {
    componentSpec = await preloadComponentReferences(componentSpec);
  }
  return componentSpec;
};

export { loadComponentFromUrl, preloadComponentReferences, XGBOOST_PIPELINE_URL, PYTORCH_PIPELINE_URL, TFX_PIPELINE_URL };
