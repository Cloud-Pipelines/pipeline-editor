import {
  useStoreState,
} from "react-flow-renderer";
import yaml from "js-yaml";

import {createGraphComponentSpecFromFlowElements} from './graphComponentFromFlow'

const GraphComponentExporter = ({pipelineName}: {pipelineName?: string}) => {
  const nodes = useStoreState((store) => store.nodes);
  const edges = useStoreState((store) => store.edges);

  pipelineName = pipelineName ?? "Pipeline";

  const graphComponent = createGraphComponentSpecFromFlowElements(nodes, edges, pipelineName);
  const componentText = yaml.dump(graphComponent, { lineWidth: 10000 });

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
