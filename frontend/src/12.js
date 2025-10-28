// // // src/App.js
// import GuacConsole from "./components/GuacConsole";
// import "./App.css";

// export default function App() {
//   const { protocol, host } = window.location;
//   const wsProto = protocol === "https:" ? "wss:" : "ws:";
//   const r1Url = `${wsProto}//${host}/ws/tunnel/node=r1`;

//   return (
//     <div className="layout">
//       <aside className="tutorial">
//         <h2>Static R1 Console</h2>
//         <p>This console is permanently connected to <b>r1</b>.</p>
//         <pre>vtysh -c "show ip bgp summary"</pre>
//       </aside>

//       <main className="consoles">
//         <div className="panes" style={{ height: "100%" }}>
//           <GuacConsole wsUrl={r1Url} />
//         </div>
//       </main>a
//     </div>
//   );
// }