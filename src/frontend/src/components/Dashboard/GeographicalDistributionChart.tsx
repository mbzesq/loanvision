import React, { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import axios from '../../utils/axios';
import interactionManager from '../../services/InteractionManager';
import Tooltip from './Tooltip';

// State name to abbreviation mapping
const stateNameToAbbr: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC'
};

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

  const handleMouseMove = (geo: any, event: React.MouseEvent) => {
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

  const handleStateClick = (geo: any) => {
    const stateName = geo.properties.name;
    const stateAbbr = stateNameToAbbr[stateName];
    const count = getLoanCount(stateName);
    
    if (count > 0 && stateAbbr) {
      const mockStateData = {
        totalUPB: count * 150000, // Mock calculation
        avgBalance: 145000 + Math.random() * 50000, // Mock data
        topCities: [
          { name: 'Primary City', count: Math.floor(count * 0.4) },
          { name: 'Secondary City', count: Math.floor(count * 0.3) },
          { name: 'Other Cities', count: Math.floor(count * 0.3) }
        ]
      };

      interactionManager.handleChartClick({
        chartType: 'geographic',
        dataPoint: {
          state: stateAbbr, // Pass abbreviation for filtering
          stateName: stateName, // Keep full name for display
          loanCount: count,
          ...mockStateData
        },
        context: { chartType: 'geographical-distribution' }
      });
    }
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
    <div 
      className="geographic-map-container"
      style={{
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
                        fill: count > 0 ? '#1f77b4' : getColor(count),
                        cursor: count > 0 ? 'pointer' : 'default',
                        stroke: count > 0 ? '#2563EB' : '#ffffff',
                        strokeWidth: count > 0 ? 2 : 0.5
                      },
                      pressed: { outline: 'none' }
                    }}
                    onMouseEnter={(event) => handleMouseEnter(geo, event)}
                    onMouseMove={(event) => handleMouseMove(geo, event)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleStateClick(geo)}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* Tooltip using Portal */}
      {tooltip && (
        <Tooltip 
          content={tooltip.content}
          x={tooltip.x}
          y={tooltip.y}
        />
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