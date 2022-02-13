/**
 * @license
 * Copyright 2021 Alexey Volkov
 * SPDX-License-Identifier: Apache-2.0
 * @author         Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 * @copyright 2021 Alexey Volkov <alexey.volkov+oss@ark-kun.com>
 */

import { DragEvent } from 'react';

import ComponentLibrary from './ComponentLibrary'
import ComponentSearch from './ComponentSearch'
import GraphComponentExporter from './GraphComponentExporter'
import VertexAiExporter from './VertexAiExporter'
import { ComponentSpec } from '../componentSpec';
import UserComponentLibrary from "./UserComponentLibrary";
import PipelineLibrary from "./PipelineLibrary";
import { AppSettings } from '../appSettings';
import PipelineSubmitter from "./PipelineSubmitter";

const onDragStart = (event: DragEvent, nodeData: object) => {
  event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
  event.dataTransfer.setData(
    "DragStart.offset",
    JSON.stringify({
      offsetX: event.nativeEvent.offsetX,
      offsetY: event.nativeEvent.offsetY,
    })
  );
  event.dataTransfer.effectAllowed = 'move';
};

interface SidebarProps {
  componentSpec?: ComponentSpec,
  setComponentSpec?: (componentSpec: ComponentSpec) => void,
  appSettings: AppSettings;
}

const Sidebar = ({
  componentSpec,
  setComponentSpec,
  appSettings
}: SidebarProps) => {
  // Do not include the DebugScratch in the production build
  let DebugScratchElement = () => null;
  if (process?.env?.NODE_ENV === "development") {
    try {
      const DebugScratch = require("./DebugScratch").default;
      DebugScratchElement = () =>
        DebugScratch({
          componentSpec: componentSpec,
          setComponentSpec: setComponentSpec,
        });
    } catch (e) {}
  }

  return (
    <aside className="nodeList">
      <details style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>Save/Load pipeline</summary>
        <PipelineLibrary
          componentSpec={componentSpec}
          setComponentSpec={setComponentSpec}
          samplePipelineLibraryUrl={appSettings.pipelineLibraryUrl}
        />
      </details>
      <details style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>Run pipeline</summary>
        <PipelineSubmitter
          componentSpec={componentSpec}
          googleCloudOAuthClientId={appSettings.googleCloudOAuthClientId}
        />
      </details>
      <h3>Drag components to the canvas:</h3>
      <details style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary><strong>Special</strong></summary>
        <div className="react-flow__node react-flow__node-input sidebar-node" onDragStart={(event: DragEvent) => onDragStart(event, { input: { label: "Input" } })} draggable>
          Input
        </div>
        <div className="react-flow__node react-flow__node-output sidebar-node" onDragStart={(event: DragEvent) => onDragStart(event, { output: { label: "Output" } })} draggable>
          Output
        </div>
      </details>
      <ComponentLibrary url={appSettings.componentLibraryUrl} />
      <details style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>User components</summary>
        <UserComponentLibrary/>
      </details>
      <details open style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>Component search</summary>
        <ComponentSearch
          componentFeedUrls={appSettings.componentFeedUrls}
          gitHubSearchLocations={appSettings.gitHubSearchLocations}
        />
      </details>
      <details>
        <summary>Debug</summary>
        {componentSpec && <GraphComponentExporter componentSpec={componentSpec}/>}
        {componentSpec && <VertexAiExporter componentSpec={componentSpec}/>}
        <DebugScratchElement/>
      </details>
    </aside>
  );
};

export default Sidebar;
