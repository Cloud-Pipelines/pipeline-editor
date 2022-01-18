/**
 * @license
 * Copyright 2022 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2022 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

export const componentLibraryUrl =
  process.env.PUBLIC_URL + "/component_library.yaml";

export interface ComponentSearchConfig {
  ComponentFeedUrls?: string[];
  GitHubUsers?: string[];
}

export const componentSearchConfig: ComponentSearchConfig = {
  ComponentFeedUrls: [
    "https://raw.githubusercontent.com/Ark-kun/pipeline_components/pipeline_component_feed/pipeline_component_feed.yaml",
  ],
  GitHubUsers: ["Ark-kun"],
};
