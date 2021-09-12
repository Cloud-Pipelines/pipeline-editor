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
import { augmentComponentSpec } from "./GraphComponentSpecFlow";
import {graphComponentSpecToVertexPipelineSpec} from './vertexAiCompiler'

interface VertexAiExporterProps {
  componentSpec: ComponentSpec;
}

const VertexAiExporter = ({componentSpec}: VertexAiExporterProps) => {
  const nodes = useStoreState((store) => store.nodes);

  let vertexPipelineSpecText = "";
  try {
    // Augmenting the componentSpec might be useless right now, but it can stabilize the output (e.g. ordering).
    // Also, in the future, the original spec might be included in the vertexPipelineSpec
    componentSpec = augmentComponentSpec(componentSpec, nodes, true, true);
    const vertexPipelineSpec = graphComponentSpecToVertexPipelineSpec(componentSpec);
    vertexPipelineSpecText = JSON.stringify(vertexPipelineSpec, undefined, 2);
  } catch(err) {
    vertexPipelineSpecText = String(err);
  }

  const vertexPipelineSpecTextBlob = new Blob([vertexPipelineSpecText], { type: "application/json" }); // Or application/x-yaml (which leads to downloading)
  // TODO: Call vertexPipelineSpecTextBlobUrl.revokeObjectURL in the future
  const vertexPipelineSpecTextBlobUrl = URL.createObjectURL(vertexPipelineSpecTextBlob);

  return (
    <details>
      <summary>
        Cloud IR <a
          href={vertexPipelineSpecTextBlobUrl}
          download={"vertex_pipeline_spec.json"}
        >
          vertex_pipeline_spec.json
        </a>
      </summary>
      <pre style={{ overflow: "auto" }}>{vertexPipelineSpecText}</pre>
    </details>
  );
};

export default VertexAiExporter;
