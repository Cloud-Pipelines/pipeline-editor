import React, { DragEvent, useEffect, useState } from 'react';

import {loadComponentFromUrl} from '../componentStore'
import {ComponentSpec, TaskSpec} from '../componentSpec'
import GraphComponentExporter from './GraphComponentExporter'

const onDragStart = (event: DragEvent, nodeData: object) => {
  event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
  event.dataTransfer.effectAllowed = 'move';
};

const Sidebar = () => {
  const [componentSpec, setComponentSpec] = useState<ComponentSpec | undefined>(undefined);

  useEffect(() => {
    loadComponentFromUrl("https://raw.githubusercontent.com/kubeflow/pipelines/603342c4b88fe2d69ff07682f702cd3601e883bb/components/PyTorch/Train_PyTorch_model/from_CSV/component.yaml").then(setComponentSpec);
  }, []);

  return (
    <aside>
      <div className="description">You can drag these nodes to the pane on the right.</div>
      <div className="react-flow__node-input" onDragStart={(event: DragEvent) => onDragStart(event, { input: { label: "Input Node" } })} draggable>
        Input Node
      </div>
      <div className="react-flow__node-default" onDragStart={(event: DragEvent) => onDragStart(event, { default: { label: "Default Node" } })} draggable>
        Default Node
      </div>
      <div className="react-flow__node-output" onDragStart={(event: DragEvent) => onDragStart(event, { output: { label: "Output Node" } })} draggable>
        Output Node
      </div>
      <div className="react-flow__node react-flow__node-multihandle" draggable
        onDragStart={(event: DragEvent) =>
          onDragStart(event, { multihandle: {
            handles: {
              top: { type: "target", ids: ["top_1", "top_2", "top_3"] },
              bottom: { type: "source", ids: ["bottom_1", "bottom_2"] },
              left: { type: "target", ids: ["left_1"] },
              right: { type: "source", ids: ["right_1"] },
            },
            label: "Multi-handle node (3-2-1-1)",
          }})
        }
      >
        Multi-port Node 3-2-1-1
      </div>
      <div className="react-flow__node react-flow__node-multihandle" draggable
        onDragStart={(event: DragEvent) => {
          // Using await inside onDragStart breaks event.dataTransfer.setData! 
          //const componentSpec = await loadComponentFromUrl("https://raw.githubusercontent.com/kubeflow/pipelines/603342c4b88fe2d69ff07682f702cd3601e883bb/components/PyTorch/Train_PyTorch_model/from_CSV/component.yaml");
          if (componentSpec === undefined) {
            return;
          }
          const inputs = componentSpec.inputs ?? []
          const inputNames = inputs.map(inputSpec => inputSpec.name);
          const outputs = componentSpec.outputs ?? []
          const outputNames = outputs.map(outputSpec => outputSpec.name);
          const componentName = componentSpec.name ?? "Component"
          console.log(inputNames)
          return onDragStart(event, { multihandle: {
            handles: {
              top: { type: "target", ids: inputNames },
              bottom: { type: "source", ids: outputNames },
            },
            label: componentName,
          }});
        }}
      >
        PyTorch/Train_PyTorch_model/from_CSV
      </div>
      {
        componentSpec !== undefined && <div className="react-flow__node react-flow__node-multihandle" draggable
          onDragStart={(event: DragEvent) => {
            const taskSpec: TaskSpec = {
              componentRef: {
                spec: componentSpec,
              },
            };
            return onDragStart(event, { task: taskSpec});
          }}
        >
          {componentSpec.name}
        </div>
      }
      <GraphComponentExporter/>
    </aside>
  );
};

export default Sidebar;
