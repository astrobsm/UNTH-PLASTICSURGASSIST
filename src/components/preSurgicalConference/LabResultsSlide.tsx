import { LabResult } from '../../services/preSurgicalConferenceService';
import { FlaskConical, Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface Props {
  labResults: LabResult[];
  categorizedResults: Record<string, LabResult[]>;
}

export default function LabResultsSlide({ labResults, categorizedResults }: Props) {
  const categories = Object.keys(categorizedResults).sort();

  if (labResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <FlaskConical className="h-24 w-24 text-gray-500 mb-4" />
        <h2 className="text-lg sm:text-2xl font-bold text-gray-400">No Laboratory Results</h2>
        <p className="text-gray-500 mt-2">No lab results have been recorded for this patient</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <FlaskConical className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Laboratory Results</h1>
        <p className="text-gray-400 mt-2">{labResults.length} tests across {categories.length} categories</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categories.map((category) => (
          <CategoryCard key={category} category={category} results={categorizedResults[category]} />
        ))}
      </div>
    </div>
  );
}

function CategoryCard({ category, results }: { category: string; results: LabResult[] }) {
  return (
    <div className="bg-white/10 rounded-xl overflow-hidden">
      <div className="bg-purple-600/30 px-5 py-3 border-b border-white/10">
        <h3 className="text-lg font-bold text-purple-300">{category}</h3>
        <p className="text-sm text-gray-400">{results.length} test(s)</p>
      </div>
      <div className="divide-y divide-white/10">
        {results.map((result) => (
          <LabResultRow key={result.id} result={result} />
        ))}
      </div>
    </div>
  );
}

function LabResultRow({ result }: { result: LabResult }) {
  const getStatusIcon = () => {
    switch (result.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-orange-400" />;
    }
  };

  const formatResults = () => {
    if (!result.results) return 'Pending';
    if (typeof result.results === 'string') return result.results;
    if (typeof result.results === 'object') {
      return Object.entries(result.results)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ');
    }
    return String(result.results);
  };

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="font-medium">{result.test_name}</span>
          </div>
          <p className="text-sm text-gray-300 mt-1">{formatResults()}</p>
          {result.ordered_by_name && (
            <p className="text-xs text-gray-500 mt-1">Ordered by: {result.ordered_by_name}</p>
          )}
        </div>
        <div className="text-right text-xs text-gray-400">
          <div className="flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>{new Date(result.ordered_at).toLocaleDateString()}</span>
          </div>
          {result.completed_at && (
            <div className="mt-1 text-green-400">
              Done: {new Date(result.completed_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
