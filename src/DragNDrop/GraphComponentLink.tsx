import { useStoreState } from "react-flow-renderer";
import yaml from "js-yaml";

import { createGraphComponentSpecFromFlowElements } from "./graphComponentFromFlow";

interface GraphComponentLinkProps {
  pipelineName?: string;
  downloadFileName?: string;
  linkText?: string;
}

const GraphComponentLink = ({
  pipelineName,
  downloadFileName = "component.yaml",
  linkText = "component.yaml",
}: GraphComponentLinkProps) => {
  const nodes = useStoreState((store) => store.nodes);
  const edges = useStoreState((store) => store.edges);

  pipelineName = pipelineName ?? "Pipeline";

  let componentText = "";
  try {
    const graphComponent = createGraphComponentSpecFromFlowElements(
      nodes,
      edges,
      pipelineName
    );
    componentText = yaml.dump(graphComponent, { lineWidth: 10000 });
  } catch (err) {
    componentText = String(err);
  }

  const componentTextBlob = new Blob([componentText], { type: "text/yaml" }); // Or application/x-yaml (which leads to downloading)
  return (
    <a
      href={URL.createObjectURL(componentTextBlob)}
      download={"component.yaml"}
    >
      component.yaml
    </a>
  );
};

export default GraphComponentLink;
