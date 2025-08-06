import React from 'react';
import Home from './pages/Home';
import PropertyForm from './components/PropertyForm';

function App() {
  return (
    <div className="App">
      <header>
        <nav style={{ padding: '10px', backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'space-around' }}>
          <a href="/">Home</a>
          <a href="/add-property">Add Property</a>
        </nav>
      </header>
      <main style={{ padding: '20px' }}>
        {/* Here you can use React Router to navigate between pages */}
        {window.location.pathname === '/' && <Home />}
        {window.location.pathname === '/add-property' && <PropertyForm />}
      </main>
    </div>
  );
}

export default App;


