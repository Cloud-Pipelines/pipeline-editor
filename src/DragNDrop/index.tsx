/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import { useEffect, useState } from 'react';
import {
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
  Node,
  useStoreState,
} from 'react-flow-renderer';
import yaml from "js-yaml";

import { downloadTextWithCache } from '../cacheUtils';
import { ComponentSpec } from '../componentSpec';
import { componentSpecToYaml } from '../componentStore';
import GraphComponentSpecFlow, { augmentComponentSpec } from './GraphComponentSpecFlow';
import Sidebar from './Sidebar';
import { getAppSettings } from '../appSettings';
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
  } catch(err: any) {
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

const EMPTY_GRAPH_COMPONENT_SPEC: ComponentSpec = {
  implementation: {
    graph: {
      tasks: {},
    },
  },
};

const DnDFlow = () => {
  const [componentSpec, setComponentSpec] = useState<ComponentSpec | undefined>();
  const [appSettings] = useState(getAppSettings());

  const downloadText = downloadTextWithCache;

  useEffect(() => {
    (async () => {
      const restoredComponentSpec = loadComponentSpec();
      if (restoredComponentSpec !== undefined) {
        setComponentSpec(restoredComponentSpec);
        return;
      }
      const defaultPipelineUrl = appSettings.defaultPipelineUrl;
      try {
        const defaultPipelineSpec = await loadComponentFromUrl(
          defaultPipelineUrl,
          downloadText
        );
        setComponentSpec(defaultPipelineSpec);
      } catch (err) {
        console.error(
          `Failed to load the default pipeline from ${defaultPipelineUrl}`
        );
        console.error(err);
        setComponentSpec(EMPTY_GRAPH_COMPONENT_SPEC);
      }
    })();
  }, [appSettings.defaultPipelineUrl, downloadText]);

  if (componentSpec === undefined) {
    return <></>;
  }

  return (
    <div className="dndflow">
      <ReactFlowProvider>
        <div className="reactflow-wrapper">
          <GraphComponentSpecFlow
            componentSpec={componentSpec}
            setComponentSpec={setComponentSpec}
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
          appSettings={appSettings}
          downloadText={downloadText}
        />
        <ComponentSpecAutoSaver componentSpec={componentSpec}/>
      </ReactFlowProvider>
    </div>
  );
};

export default DnDFlow;
