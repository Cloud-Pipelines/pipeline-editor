/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import { useStoreState } from "react-flow-renderer";

import { ComponentSpec } from "../componentSpec";
import { componentSpecToYaml } from "../componentStore";
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

  try {
    componentSpec = augmentComponentSpec(componentSpec, nodes, false, true);
  } catch (err) {
    if (err?.message?.startsWith("The nodes array does not") !== true) {
      console.error(err);
      return <>err.toString()</>;
    }
  }
  const componentText = componentSpecToYaml(componentSpec);
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
