import { useStoreState } from "react-flow-renderer";
import yaml from "js-yaml";

import { createGraphComponentSpecFromFlowElements } from "./graphComponentFromFlow";
import { ComponentSpec } from "../componentSpec";
import { augmentComponentSpec } from "./GraphComponentSpecFlow";

interface GraphComponentLinkProps {
  componentSpec: ComponentSpec;
  downloadFileName?: string;
  linkText?: string;
}

const GraphComponentLink = ({
  componentSpec,
  downloadFileName = "component.yaml",
  linkText = "component.yaml",
}: GraphComponentLinkProps) => {
  const nodes = useStoreState((store) => store.nodes);


  let componentText = "";
  try {
    componentSpec = augmentComponentSpec(componentSpec, nodes, false, true);
    componentText = yaml.dump(componentSpec, { lineWidth: 10000 });
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
