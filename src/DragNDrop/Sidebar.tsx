import { DragEvent } from 'react';

import ComponentLibrary from './ComponentLibrary'
import ComponentSearch from './ComponentSearch'
import GraphComponentExporter from './GraphComponentExporter'
import GoogleCloudSubmitter from './GoogleCloud'
import VertexAiExporter from './VertexAiExporter'
import { ComponentSpec } from '../componentSpec';
import { loadComponentFromUrl, DATA_PASSING_PIPELINE_URL } from './samplePipelines';
import UserComponentLibrary from "./UserComponentLibrary";
import PipelineLibrary from "./PipelineLibrary";
import { COMPONENT_LIBRARY } from "./sampleComponentLibrary"

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
}

const Sidebar = ({
  componentSpec,
  setComponentSpec
}: SidebarProps) => {
  return (
    <aside className="nodeList">
      <details style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>Save/Load pipeline</summary>
        <PipelineLibrary componentSpec={componentSpec} setComponentSpec={setComponentSpec}/>
      </details>
      <details style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>Submit to Google Cloud</summary>
        <GoogleCloudSubmitter componentSpec={componentSpec}/>
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
      <ComponentLibrary componentGroups={COMPONENT_LIBRARY}/>
      <details style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>User components</summary>
        <UserComponentLibrary/>
      </details>
      <details open style={{ border: "1px solid #aaa", borderRadius: "4px", padding: "4px" }}>
        <summary style={{ borderWidth: "1px", padding: "4px", fontWeight: "bold" }}>Component search</summary>
        <ComponentSearch />
      </details>
      <details>
        <summary>Debug</summary>
        {componentSpec && <GraphComponentExporter componentSpec={componentSpec}/>}
        {componentSpec && <VertexAiExporter componentSpec={componentSpec}/>}
        <button
          type="button"
          onClick={(e) => {
            loadComponentFromUrl(DATA_PASSING_PIPELINE_URL).then(setComponentSpec);
          }}
        >
          Load Data Passing pipeline
        </button>
      </details>
    </aside>
  );
};

export default Sidebar;
