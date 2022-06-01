/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import { downloadTextWithCache } from "../cacheUtils";
import { ComponentSpec } from "../componentSpec";
import { downloadComponentDataWithCache } from "../github";

export const preloadComponentReferences = async (
  componentSpec: ComponentSpec,
  downloadText: (url: string) => Promise<string> = downloadTextWithCache,
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
            componentUrl,
            downloadText
          );
          componentMap.set(componentUrl, taskComponentSpec);
        }
        taskSpec.componentRef.spec = taskComponentSpec;
        await preloadComponentReferences(
          taskComponentSpec,
          downloadText,
          componentMap,
        );
      }
    }
  }
  return componentSpec;
};

export const loadComponentFromUrl = async (
  url: string,
  downloadText: (url: string) => Promise<string> = downloadTextWithCache,
  preloadChildComponentSpecs = true,
) => {
  let componentSpec = await downloadComponentDataWithCache(url, downloadText);
  if (preloadChildComponentSpecs) {
    componentSpec = await preloadComponentReferences(
      componentSpec,
      downloadText
    );
  }
  return componentSpec;
};
