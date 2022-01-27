/**
 * @license
 * Copyright 2022 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2022 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

export const componentLibraryUrl =
  process.env.PUBLIC_URL + "/component_library.yaml";

export const pipelineLibraryUrl =
  process.env.PUBLIC_URL + "/pipeline_library.yaml";

// TODO: Remove this in favor of taking the first pipeline from the pipeline library
export const defaultPipelineUrl =
  "https://raw.githubusercontent.com/Ark-kun/pipelines/2edfd25b5ee3a4aa149c24a225a50041fbd3662d/components/XGBoost/_samples/sample_pipeline.pipeline.component.yaml";

export interface ComponentSearchConfig {
  ComponentFeedUrls?: string[];
  GitHubSearchLocations?: string[];
}

export const componentSearchConfig: ComponentSearchConfig = {
  ComponentFeedUrls: [
    "https://raw.githubusercontent.com/Ark-kun/pipeline_components/pipeline_component_feed/pipeline_component_feed.yaml",
  ],
  GitHubSearchLocations: ["repo:Ark-kun/pipeline_components path:components"],
};

export const googleCloudOAuthClientId =
  "640001104961-2m8hs192tmd9f9nssbr5thr5o3uhmita.apps.googleusercontent.com";
