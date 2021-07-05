import { useState } from 'react';
import {
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
} from 'react-flow-renderer';

import { GraphSpec } from '../componentSpec';
import GraphComponentSpecFlow from './GraphComponentSpecFlow';
import Sidebar from './Sidebar';
import { preloadComponentReferences, xgBoostQueryTrainPredictPipeline } from "./samplePipelines";

import './dnd.css';

const GRID_SIZE = 10;

const DnDFlow = () => {
  const [graphSpec, setGraphSpec] = useState<GraphSpec | undefined>();

  if (graphSpec === undefined) {
    try {
      (async () => {
        const pipeline = await preloadComponentReferences(xgBoostQueryTrainPredictPipeline);
        if ("graph" in pipeline.implementation) {
          setGraphSpec(pipeline.implementation.graph);
        }
      })();
    } catch {
    }
  };

  if (graphSpec === undefined) {
    return (<></>);
  }

  return (
    <div className="dndflow">
      <ReactFlowProvider>
        <div className="reactflow-wrapper">
          <GraphComponentSpecFlow
            initialGraphSpec={graphSpec}
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
