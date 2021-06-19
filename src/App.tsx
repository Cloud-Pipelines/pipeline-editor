import logo from './logo.svg';
import './App.css';
import DnDFlow from './DragNDrop/index';

function App() {
  return (
    <div className="App" style={{width: "100%", height: "90%"}}>
      <DnDFlow/>
      <header className="App-header">
        {/* <img src={logo} className="App-logo" alt="logo" /> */}
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          LeZzzzarn React
        </a>
      </header>
    </div>
  );
}

export default App;
