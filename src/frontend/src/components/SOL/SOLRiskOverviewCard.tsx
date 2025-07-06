import React, { useState, useEffect } from 'react';
import axios from '../utils/axios';

interface SOLSummary {
  total_loans: number;
  expired_count: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  alerts: string[];
}

interface SOLRiskOverviewCardProps {
  onRiskLevelClick?: (riskLevel: 'expired' | 'high' | 'medium' | 'low') => void;
}

const SOLRiskOverviewCard: React.FC<SOLRiskOverviewCardProps> = ({ onRiskLevelClick }) => {
  const [solData, setSolData] = useState<SOLSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSOLData();
  }, []);

  const fetchSOLData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/sol/dashboard-data');
      setSolData(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching SOL data:', err);
      setError('Failed to load SOL data');
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (count: number, total: number): string => {
    if (total === 0) return '0.0%';
    return `(${((count / total) * 100).toFixed(1)}%)`;
  };

  const handleRiskClick = (riskLevel: 'expired' | 'high' | 'medium' | 'low') => {
    if (onRiskLevelClick) {
      onRiskLevelClick(riskLevel);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border border-red-200">
        <div className="flex items-center space-x-2 text-red-600">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-semibold">SOL Monitor Error</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
        <button 
          onClick={fetchSOLData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!solData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-600">No SOL data available</h3>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-4">
        <div className="flex items-center space-x-2">
          <span className="text-xl">🚨</span>
          <h3 className="text-lg font-semibold">Statute of Limitations Monitor</h3>
        </div>
        <p className="text-sm opacity-90 mt-1">
          {solData.total_loans} loans analyzed
        </p>
      </div>

      {/* Risk Level Rows */}
      <div className="p-4 space-y-2">
        {/* Expired - Always clickable, highest priority */}
        <div 
          onClick={() => handleRiskClick('expired')}
          className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
            solData.expired_count > 0 
              ? 'border-black bg-black text-white cursor-pointer hover:bg-gray-800 shadow-lg' 
              : 'border-gray-300 bg-gray-50 text-gray-600 cursor-pointer hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center space-x-3">
            <span className="text-xl">⚫</span>
            <span className="font-medium">
              {solData.expired_count} Expired
            </span>
          </div>
          <span className="text-sm font-medium">
            {formatPercentage(solData.expired_count, solData.total_loans)}
          </span>
        </div>

        {/* High Risk - Always clickable, second priority */}
        <div 
          onClick={() => handleRiskClick('high')}
          className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
            solData.high_risk_count > 0 
              ? 'border-red-400 bg-red-50 text-red-800 cursor-pointer hover:bg-red-100 shadow-md' 
              : 'border-gray-300 bg-gray-50 text-gray-600 cursor-pointer hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center space-x-3">
            <span className="text-xl">🔴</span>
            <span className="font-medium">
              {solData.high_risk_count} High Risk
            </span>
          </div>
          <span className="text-sm font-medium">
            {formatPercentage(solData.high_risk_count, solData.total_loans)}
          </span>
        </div>

        {/* Medium Risk - Clickable when count > 0 */}
        <div 
          onClick={() => solData.medium_risk_count > 0 && handleRiskClick('medium')}
          className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
            solData.medium_risk_count > 0 
              ? 'border-yellow-400 bg-yellow-50 text-yellow-800 cursor-pointer hover:bg-yellow-100' 
              : 'border-gray-300 bg-gray-50 text-gray-600'
          }`}
        >
          <div className="flex items-center space-x-3">
            <span className="text-xl">🟡</span>
            <span className="font-medium">
              {solData.medium_risk_count} Medium Risk
            </span>
          </div>
          <span className="text-sm font-medium">
            {formatPercentage(solData.medium_risk_count, solData.total_loans)}
          </span>
        </div>

        {/* Low Risk - Informational only, subtle styling */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-green-50 text-green-700">
          <div className="flex items-center space-x-3">
            <span className="text-xl">🟢</span>
            <span className="font-medium">
              {solData.low_risk_count} Low Risk
            </span>
          </div>
          <span className="text-sm font-medium">
            {formatPercentage(solData.low_risk_count, solData.total_loans)}
          </span>
        </div>
      </div>

      {/* Action Button */}
      <div className="border-t border-gray-200 p-4">
        <button 
          onClick={() => handleRiskClick('expired')}
          className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center space-x-2"
        >
          <span>View Critical Loans</span>
          <span>→</span>
        </button>
      </div>

      {/* Last Updated */}
      <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center">
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
};

export default SOLRiskOverviewCard;