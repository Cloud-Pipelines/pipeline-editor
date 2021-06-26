import yaml from "js-yaml";

import { ComponentSpec } from "./componentSpec";

export async function loadComponentFromUrl(
  url: string
): Promise<ComponentSpec> {
  return fetch(url)
    .then((response) => response.text())
    .then((response) => yaml.load(response) as ComponentSpec);
}
