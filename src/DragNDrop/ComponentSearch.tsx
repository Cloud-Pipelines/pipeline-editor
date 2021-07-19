import { useState } from "react";
import { ComponentReference } from "../componentSpec";
import { searchComponentsByName } from "../github";
import DraggableComponent from "./DraggableComponent";

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
    const componentElements = items.map((componentRef) => (
      <DraggableComponent
        key={componentRef.digest ?? componentRef.url}
        componentReference={componentRef}
      />
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
