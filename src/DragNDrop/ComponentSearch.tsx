import React, { DragEvent } from "react";
import { useState } from "react";
import { ComponentReference, TaskSpec } from "../componentSpec";
import { searchComponentsByName } from "../github";

const onDragStart = (event: DragEvent, nodeData: object) => {
  event.dataTransfer.setData("application/reactflow", JSON.stringify(nodeData));
  event.dataTransfer.effectAllowed = "move";
};

const COMPONENT_ORGS = ["kubeflow", "Ark-kun"];

const SearchPanel = (props: any) => {
  const [error, setError] = useState<string | undefined>(undefined);
  const [firstTime, setFirstTime] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ComponentReference[]>([]);

  const onQueryChange = (e: any) => {
    setQuery(e.target.value);
  };

  async function fetchData(query: string) {
    searchComponentsByName(query, COMPONENT_ORGS).then(
      (componentRefs) => {
        setIsLoaded(true);
        setItems(componentRefs);
      },
      (error) => {
        setIsLoaded(true);
        setError(error.message);
      }
    );
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query !== "") {
      setFirstTime(false);
      fetchData(query);
    }
  };

  let results = <span></span>;
  if (firstTime) {
    results = <div>Enter search query</div>;
  } else if (error !== undefined) {
    results = <div>Error: {error}</div>;
  } else if (!firstTime && !isLoaded) {
    results = <div>Searching...</div>;
  } else if (items !== undefined) {
    const componentElements = items.map((item) => (
      <div
        key={item.url}
        title={item.url}
        className="react-flow__node react-flow__node-multihandle"
        draggable
        onDragStart={(event: DragEvent) => {
          const taskSpec: TaskSpec = {
            componentRef: item,
          };
          return onDragStart(event, { task: taskSpec });
        }}
      >
        {item.spec?.name}
      </div>
    ));
    results = <>{componentElements}</>;
  }
  return (
    <div className="nodeList">
      <form onSubmit={onSubmit}>
        <input type="search" placeholder="XGBoost" onChange={onQueryChange} />
        <input type="submit" />
      </form>
      <div>{results}</div>
    </div>
  );
};

export default SearchPanel;
