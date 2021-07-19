import { useEffect, useState } from 'react';

import {downloadComponentDataWithCache} from '../github'
import { ComponentSpec } from '../componentSpec'
import DraggableComponent from "./DraggableComponent";

type ComponentGroup = {
  category: string;
  componentUrls: string[];
};

const DraggableComponentRow = ({componentUrl}: {componentUrl: string}) => {
  const [componentSpec, setComponentSpec] = useState<ComponentSpec | undefined>(undefined);
  useEffect(() => {
    downloadComponentDataWithCache(componentUrl).then(setComponentSpec);
  }, [componentUrl]);

  if (componentSpec === undefined) {
    return <span>Loading...</span>
  } else {
    return (
      <DraggableComponent
        componentReference={{
          url: componentUrl,
          spec: componentSpec,
        }}
      />
    );
  }
};

const ComponentGroupList = ({ componentGroups }: { componentGroups: ComponentGroup[] }) => {
  return (
    <>
      {Array.from(componentGroups).map(
        ({ category, componentUrls }, index) => (
          <details key={category} open={index === 0} style={{ border: "1px solid #aaa", borderRadius: "4px" }}>
            <summary style={{ borderWidth: "1px", padding: "8px" }}>
              <strong>{category}</strong>
            </summary>
            {componentUrls.map((componentUrl) => (
              <DraggableComponentRow key={componentUrl} componentUrl={componentUrl} />
            ))}
          </details>
        )
      )}
    </>
  );
};

const ComponentLibrary = ({ componentGroups }: { componentGroups: ComponentGroup[] }) => {
  return (
    <details open>
      <summary style={{ border: "1px solid #aaa", padding: "4px", borderRadius: "4px" }}>
        <strong>Component library</strong>
      </summary>
      <div style={{ paddingLeft: "10px" }}>
        <ComponentGroupList componentGroups={componentGroups}/>
      </div>
    </details>
  );
};

export default ComponentLibrary;
