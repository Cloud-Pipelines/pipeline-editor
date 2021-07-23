import { useStoreState } from "react-flow-renderer";
import yaml from "js-yaml";

import { ComponentSpec } from "../componentSpec";
import { augmentComponentSpec } from "./GraphComponentSpecFlow";

interface GraphComponentLinkProps {
  componentSpec: ComponentSpec;
  downloadFileName?: string;
  linkText?: string;
  linkRef?: React.Ref<HTMLAnchorElement>;
  style?: React.CSSProperties;
}

const GraphComponentLink = ({
  componentSpec,
  downloadFileName = "component.yaml",
  linkText = "component.yaml",
  linkRef,
  style,
}: GraphComponentLinkProps) => {
  const nodes = useStoreState((store) => store.nodes);

  let componentText = "";
  try {
    componentSpec = augmentComponentSpec(componentSpec, nodes, false, true);
    componentText = yaml.dump(componentSpec, { lineWidth: 10000 });
  } catch (err) {
    return <>err.toString()</>;
  }

  const componentTextBlob = new Blob([componentText], { type: "text/yaml" }); // Or application/x-yaml (which leads to downloading)
  return (
    <a
      ref={linkRef}
      href={URL.createObjectURL(componentTextBlob)}
      download={downloadFileName}
      style={style}
    >
      {linkText}
    </a>
  );
};

export default GraphComponentLink;
