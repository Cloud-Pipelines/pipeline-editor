/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import {
  useStoreState,
} from "react-flow-renderer";

import { ComponentSpec } from "../componentSpec";
import { augmentComponentSpec } from './GraphComponentSpecFlow'

interface GraphComponentExporterProps {
  componentSpec: ComponentSpec,
}

const GraphComponentExporter = ({
  componentSpec,
}: GraphComponentExporterProps) => {
  const nodes = useStoreState((store) => store.nodes);

  let componentText = "";
  try {
    const graphComponent = augmentComponentSpec(componentSpec, nodes, false, true);
    componentText = yaml.dump(graphComponent, { lineWidth: 10000 });
  } catch(err) {
    componentText = String(err);
  }

  const componentTextBlob = new Blob([componentText], { type: "text/yaml" }); // Or application/x-yaml (which leads to downloading)
  const downloadLink = <a href={URL.createObjectURL(componentTextBlob)} download={"component.yaml"}>component.yaml</a>

  return (
    <details>
      <summary>Graph {downloadLink}</summary>
      <pre style={{overflow: "auto"}}>{componentText}</pre>
    </details>
  );
};

export default GraphComponentExporter;
