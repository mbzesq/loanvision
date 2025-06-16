import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState<string>('loading...');

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(() => setStatus('error'));
  }, []);

  return <h1>Backend Status: {status}</h1>;
}

export default App;