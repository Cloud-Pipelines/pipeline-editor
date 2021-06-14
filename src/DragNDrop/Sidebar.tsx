import React, { DragEvent } from 'react';

const onDragStart = (event: DragEvent, nodeData: object) => {
  event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
  event.dataTransfer.effectAllowed = 'move';
};

const Sidebar = () => {
  return (
    <aside>
      <div className="description">You can drag these nodes to the pane on the right.</div>
      <div className="dndnode input" onDragStart={(event: DragEvent) => onDragStart(event, {nodeType: 'input'})} draggable>
        Input Node
      </div>
      <div className="dndnode" onDragStart={(event: DragEvent) => onDragStart(event, {nodeType: 'default'})} draggable>
        Default Node
      </div>
      <div className="dndnode output" onDragStart={(event: DragEvent) => onDragStart(event, {nodeType: 'output'})} draggable>
        Output Node
      </div>
    </aside>
  );
};

export default Sidebar;
