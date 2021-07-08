import { useState } from 'react';
import {
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
} from 'react-flow-renderer';

import { ComponentSpec } from '../componentSpec';
import GraphComponentSpecFlow from './GraphComponentSpecFlow';
import Sidebar from './Sidebar';
import { preloadComponentReferences, xgBoostQueryTrainPredictPipeline } from "./samplePipelines";

import './dnd.css';

const GRID_SIZE = 10;

const DnDFlow = () => {
  const [componentSpec, setComponentSpec] = useState<ComponentSpec | undefined>();

  if (componentSpec === undefined) {
    preloadComponentReferences(xgBoostQueryTrainPredictPipeline).then(setComponentSpec);
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
            deleteKeyCode='Delete'
            multiSelectionKeyCode='Control'
            snapToGrid={true}
            snapGrid={[GRID_SIZE, GRID_SIZE]}
          >
            <MiniMap/>
            <Controls />
            <Background gap={GRID_SIZE}/>
          </GraphComponentSpecFlow>
        </div>
        <Sidebar />
      </ReactFlowProvider>
    </div>
  );
};

export default DnDFlow;
