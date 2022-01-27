/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import { useState } from 'react';
import {
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
  Node,
  useStoreState,
} from 'react-flow-renderer';
import yaml from "js-yaml";

import { ComponentSpec } from '../componentSpec';
import { componentSpecToYaml } from '../componentStore';
import GraphComponentSpecFlow, { augmentComponentSpec } from './GraphComponentSpecFlow';
import Sidebar from './Sidebar';
import { defaultPipelineUrl } from '../appSettings';
import { loadComponentFromUrl } from "./samplePipelines";

import './dnd.css';

const GRID_SIZE = 10;
const SAVED_COMPONENT_SPEC_KEY = "autosaved.component.yaml";

const saveComponentSpec = (componentSpec: ComponentSpec, nodes?: Node[]) => {
  try {
    if (nodes !== undefined) {
      if (nodes.length === 0) {
        console.warn("saveComponentSpec: nodes.length === 0");
      }
      componentSpec = augmentComponentSpec(componentSpec, nodes, true, true);
    }
    const componentText = componentSpecToYaml(componentSpec);
    window.sessionStorage.setItem(SAVED_COMPONENT_SPEC_KEY, componentText);
  } catch(err) {
    // TODO: Find a way to avoid the React/Redux race conditions causing this error.
    if (err?.message?.startsWith("The nodes array does not") !== true) {
      console.error(err);
    }
  }
}

const loadComponentSpec = () => {
  try {
    const componentText = window.sessionStorage.getItem(SAVED_COMPONENT_SPEC_KEY);
    if (componentText !== null) {
      const loadedYaml = yaml.load(componentText);
      if (loadedYaml !== null && typeof loadedYaml === "object") {
        //TODO: Validate that the spec is valid
        const savedComponentSpec = loadedYaml as ComponentSpec;
        return savedComponentSpec;
      }
    }
  } catch(err) {
    console.error(err);
  }
  return undefined;
}

// Auto-saver is extracted to its own child component since useStoreState in the parent causes infinite re-rendering
// (each render of GraphComponentSpecFlow seems to change the Redux store).
// This component seems to be triggered for every node movement, so even pure layout changes are saved.
const ComponentSpecAutoSaver = ({
  componentSpec,
}: {
  componentSpec: ComponentSpec;
}) => {
  const nodes = useStoreState((store) => store.nodes);
  // Fixing issue where a React error would cause all node positions to be recorded as undefined (`!<tag:yaml.org,2002:js/undefined>`)
  // nodes should never be undefined in normal situation.
  if (nodes !== undefined && nodes.length > 0) {
    saveComponentSpec(componentSpec, nodes);
  }
  return null;
};

const isAppleOS = () =>
  window.navigator.platform.startsWith("Mac") ||
  window.navigator.platform.startsWith("iPhone") ||
  window.navigator.platform.startsWith("iPad") ||
  window.navigator.platform.startsWith("iPod");

const DnDFlow = () => {
  const [componentSpec, setComponentSpec] = useState<ComponentSpec | undefined>();

  if (componentSpec === undefined) {
    const restoredComponentSpec = loadComponentSpec();
    if (restoredComponentSpec === undefined) {
      loadComponentFromUrl(defaultPipelineUrl).then(setComponentSpec);
    } else {
      setComponentSpec(restoredComponentSpec);
    }
  };

  if (componentSpec === undefined) {
    return (<></>);
  }

  return (
    <div className="dndflow">
      <ReactFlowProvider>
        <div className="reactflow-wrapper">
          <GraphComponentSpecFlow
            componentSpec={componentSpec}
            setComponentSpec={setComponentSpec}
            deleteKeyCode={isAppleOS() ? "Backspace" : "Delete"}
            multiSelectionKeyCode={isAppleOS() ? "Command" : "Control"}
            snapToGrid={true}
            snapGrid={[GRID_SIZE, GRID_SIZE]}
          >
            <MiniMap/>
            <Controls />
            <Background gap={GRID_SIZE}/>
          </GraphComponentSpecFlow>
        </div>
        <Sidebar
          componentSpec={componentSpec}
          setComponentSpec={setComponentSpec}
        />
        <ComponentSpecAutoSaver componentSpec={componentSpec}/>
      </ReactFlowProvider>
    </div>
  );
};

export default DnDFlow;
