import React, { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import axios from '../../utils/axios';

interface GeographicalData {
  state: string;
  count: number;
}

const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const GeographicalDistributionChart: React.FC = () => {
  const [data, setData] = useState<GeographicalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<GeographicalData[]>('/api/reports/loan-geographical-distribution');
        setData(response.data);
      } catch (err) {
        setError('Failed to fetch geographical distribution data');
        console.error('Error fetching geographical distribution:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Create a map of state names to loan counts for quick lookup
  const stateDataMap = data.reduce((acc, item) => {
    acc[item.state] = item.count;
    return acc;
  }, {} as Record<string, number>);

  // Find max count for color scaling
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Color scale function - light blue to dark blue
  const getColor = (count: number) => {
    if (count === 0) return '#f1f5f9'; // Light grey for no loans
    const intensity = count / maxCount;
    // Blue color scale from light to dark
    const blue = Math.floor(255 - (intensity * 200)); // 255 to 55
    return `rgb(${blue}, ${blue + 20}, 255)`;
  };

  // Get loan count for a state by name
  const getLoanCount = (stateName: string) => {
    // Try exact match first
    if (stateDataMap[stateName]) {
      return stateDataMap[stateName];
    }
    
    // Try to find by partial match (in case of different naming conventions)
    const matchingState = data.find(d => 
      d.state.toLowerCase().includes(stateName.toLowerCase()) ||
      stateName.toLowerCase().includes(d.state.toLowerCase())
    );
    
    return matchingState ? matchingState.count : 0;
  };

  const handleMouseEnter = (geo: any, event: React.MouseEvent) => {
    const stateName = geo.properties.name;
    const count = getLoanCount(stateName);
    setTooltip({
      content: `${stateName}: ${count} loans`,
      x: event.clientX,
      y: event.clientY
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e0e0e0',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p>Loading map...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e0e0e0',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '24px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e0e0e0',
      height: '400px',
      position: 'relative'
    }}>
      <h3 style={{
        margin: '0 0 20px 0',
        fontSize: '18px',
        fontWeight: '600',
        color: '#333'
      }}>
        Geographical Distribution
      </h3>
      
      <div style={{ height: 'calc(100% - 60px)', width: '100%' }}>
        <ComposableMap 
          projection="geoAlbersUsa"
          style={{ width: '100%', height: '100%' }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const stateName = geo.properties.name;
                const count = getLoanCount(stateName);
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getColor(count)}
                    stroke="#ffffff"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: { 
                        outline: 'none',
                        fill: '#1f77b4',
                        cursor: 'pointer'
                      },
                      pressed: { outline: 'none' }
                    }}
                    onMouseEnter={(event) => handleMouseEnter(geo, event)}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 10,
            top: tooltip.y - 30,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        fontSize: '10px',
        color: '#666'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Low</span>
          <div style={{
            width: '60px',
            height: '10px',
            background: 'linear-gradient(to right, #f1f5f9, #3730ff)',
            border: '1px solid #ddd'
          }} />
          <span>High</span>
        </div>
      </div>
    </div>
  );
};

export default GeographicalDistributionChart;