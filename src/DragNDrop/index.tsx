import React, { useState, DragEvent } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  updateEdge,
  removeElements,
  Controls,
  OnLoadParams,
  Elements,
  Connection,
  Edge,
  ElementId,
  Node,
  Background,
  MiniMap,
} from 'react-flow-renderer';

import Sidebar from './Sidebar';
import ComponentTaskNode from './ComponentTaskNode';

import './dnd.css';

const GRID_SIZE = 10;

const nodeTypes = {
  task: ComponentTaskNode,
};

const initialElements = [{ id: '1', type: 'input', data: { label: 'input node' }, position: { x: 250, y: 10 } }];

const onDragOver = (event: DragEvent) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};

let nodeNames = new Set<string>();
const getId = (nodeType: string, nodeData: any): ElementId => {
  const baseName = nodeData?.componentRef?.spec?.name ?? nodeType;
  let finalName = baseName;
  let index = 0;
  while (nodeNames.has(finalName)) {
    index++;
    finalName = baseName + " " + index.toString();
  }
  nodeNames.add(finalName);
  return finalName;
};

const DnDFlow = () => {
  const [reactFlowInstance, setReactFlowInstance] = useState<OnLoadParams>();
  const [elements, setElements] = useState<Elements>(initialElements);

  // gets called after end of edge gets dragged to another source or target
  const onEdgeUpdate = (oldEdge: Edge, newConnection: Connection) =>
    setElements((els) => updateEdge(oldEdge, newConnection, els));
  const onConnect = (params: Connection | Edge) => setElements((els) => addEdge(params, els));
  const onElementsRemove = (elementsToRemove: Elements) => {
    for (const element of elementsToRemove) {
      nodeNames.delete(element.id);
    }
    setElements((els) => removeElements(elementsToRemove, els));
  };
  const onLoad = (_reactFlowInstance: OnLoadParams) => setReactFlowInstance(_reactFlowInstance);

  const onEdgeUpdateStart = (_: React.MouseEvent, edge: Edge) => console.log('start update', edge);
  const onEdgeUpdateEnd = (_: MouseEvent, edge: Edge) => console.log('end update', edge);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();

    if (reactFlowInstance) {
      const droppedData = event.dataTransfer.getData('application/reactflow');
      if (droppedData === "") {
        return;
      }
      const droppedDataObject = JSON.parse(droppedData);
      const nodeType = Object.keys(droppedDataObject)[0];
      const nodeData = droppedDataObject[nodeType];
      const position = reactFlowInstance.project({ x: event.clientX, y: event.clientY - 40 });
      const newNode: Node = {
        id: getId(nodeType, nodeData),
        type: nodeType,
        position,
        data: nodeData,
      };

      setElements((es) => es.concat(newNode));
    }
  };

  return (
    <div className="dndflow">
      <ReactFlowProvider>
        <div className="reactflow-wrapper">
          <ReactFlow
            elements={elements}
            onConnect={onConnect}
            onElementsRemove={onElementsRemove}
            onEdgeUpdateStart={onEdgeUpdateStart}
            onEdgeUpdateEnd={onEdgeUpdateEnd}
            onEdgeUpdate={onEdgeUpdate}
            onLoad={onLoad}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            deleteKeyCode='Delete'
            multiSelectionKeyCode='Control'
            snapToGrid={true}
            snapGrid={[GRID_SIZE, GRID_SIZE]}
          >
            <MiniMap/>
            <Controls />
            <Background gap={GRID_SIZE}/>
          </ReactFlow>
        </div>
        <Sidebar />
      </ReactFlowProvider>
    </div>
  );
};

export default DnDFlow;
