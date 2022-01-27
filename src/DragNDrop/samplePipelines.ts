/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import { ComponentSpec } from "../componentSpec";
import { downloadComponentDataWithCache } from "../github";

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

export { loadComponentFromUrl, preloadComponentReferences };
