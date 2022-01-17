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
  GitHubUsers?: string[];
}

export const componentSearchConfig: ComponentSearchConfig = {
  GitHubUsers: ["Ark-kun", "Kubeflow"],
};
