import {
  useStoreState,
} from "react-flow-renderer";

import {createGraphComponentSpecFromFlowElements} from './graphComponentFromFlow'
import {graphComponentSpecToVertexPipelineSpec, generateVertexPipelineJobFromGraphComponent} from './vertexAiCompiler'

// const getVertexPipelineJob = (gcsOutputDirectory: string, pipelineName?: string) => {
//   const nodes = useStoreState((store) => store.nodes);
//   const edges = useStoreState((store) => store.edges);

//   pipelineName = pipelineName ?? "Pipeline";

//   const graphComponent = createGraphComponentSpecFromFlowElements(nodes, edges, pipelineName, undefined, false, true);
//   const vertexPipelineJob = generateVertexPipelineJobFromGraphComponent(graphComponent, gcsOutputDirectory);
// }

const VertexAiExporter = ({pipelineName}: {pipelineName?: string}) => {
  const nodes = useStoreState((store) => store.nodes);
  const edges = useStoreState((store) => store.edges);

  pipelineName = pipelineName ?? "Pipeline";

  let vertexPipelineSpecText = "";
  try {
    const graphComponent = createGraphComponentSpecFromFlowElements(nodes, edges, pipelineName, undefined, false, true);
    const vertexPipelineSpec = graphComponentSpecToVertexPipelineSpec(graphComponent);
    vertexPipelineSpecText = JSON.stringify(vertexPipelineSpec, undefined, 4);
    console.log(vertexPipelineSpecText);
  } catch(err) {
    vertexPipelineSpecText = String(err);
  }

  const vertexPipelineSpecTextBlob = new Blob([vertexPipelineSpecText], { type: "application/json" }); // Or application/x-yaml (which leads to downloading)
  const downloadLink = <a href={URL.createObjectURL(vertexPipelineSpecTextBlob)} download={"pipeline.json"}>pipeline.json</a>

  return (
    <details open>
      <summary>Cloud IR {downloadLink}</summary>
      <pre style={{overflow: "auto"}}>{vertexPipelineSpecText}</pre>
    </details>
  );
};

export default VertexAiExporter;
