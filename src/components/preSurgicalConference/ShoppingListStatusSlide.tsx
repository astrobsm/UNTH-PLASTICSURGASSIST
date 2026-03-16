import { ShoppingListStatus } from '../../services/preSurgicalConferenceService';
import { ShoppingCart, CheckCircle, Clock, AlertTriangle, Package } from 'lucide-react';

interface Props {
  shoppingList: ShoppingListStatus;
}

export default function ShoppingListStatusSlide({ shoppingList }: Props) {
  const completionPercentage = shoppingList.total_items > 0 
    ? Math.round((shoppingList.procured_items / shoppingList.total_items) * 100)
    : 0;

  const isComplete = shoppingList.is_complete;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <div className={`w-24 h-24 ${isComplete ? 'bg-green-600' : 'bg-orange-600'} rounded-full flex items-center justify-center mx-auto mb-4`}>
          {isComplete ? (
            <CheckCircle className="h-14 w-14 text-white" />
          ) : (
            <ShoppingCart className="h-12 w-12 text-white" />
          )}
        </div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Shopping List Status</h1>
        <p className={`text-xl mt-2 ${isComplete ? 'text-green-400' : 'text-orange-400'}`}>
          {isComplete ? 'Complete - Ready for Surgery' : 'Incomplete - Items Pending'}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="bg-white/10 rounded-2xl p-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-medium">Procurement Progress</span>
          <span className={`text-lg sm:text-2xl font-bold ${isComplete ? 'text-green-400' : 'text-orange-400'}`}>
            {completionPercentage}%
          </span>
        </div>
        <div className="w-full h-6 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-orange-500'}`}
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-4 text-sm text-gray-400">
          <span>{shoppingList.procured_items} items procured</span>
          <span>{shoppingList.pending_items} items pending</span>
          <span>{shoppingList.total_items} total items</span>
        </div>
      </div>

      {/* Status Card */}
      <div className={`${isComplete ? 'bg-green-900/30 border-green-500/30' : 'bg-orange-900/30 border-orange-500/30'} border rounded-2xl p-8`}>
        <div className="flex items-center space-x-4 mb-6">
          {isComplete ? (
            <CheckCircle className="h-10 w-10 text-green-500" />
          ) : (
            <AlertTriangle className="h-10 w-10 text-orange-500" />
          )}
          <div>
            <h3 className="text-xl font-bold">
              {isComplete ? 'All Items Procured' : 'Pending Items Require Attention'}
            </h3>
            <p className="text-gray-400">
              {isComplete 
                ? 'All required surgical consumables and equipment have been acquired'
                : 'Some items are still pending procurement before surgery can proceed'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Items List */}
      {shoppingList.items && shoppingList.items.length > 0 && (
        <div className="bg-white/10 rounded-2xl overflow-hidden">
          <div className="bg-white/5 px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10">
            <h3 className="text-lg font-bold flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Items List</span>
            </h3>
          </div>
          <div className="divide-y divide-white/10">
            {shoppingList.items.map((item, index) => (
              <ItemRow key={index} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Summary Message */}
      {isComplete && (
        <div className="text-center bg-green-600/20 border border-green-500/50 rounded-xl p-6">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-green-400">Ready for Surgery</h3>
          <p className="text-gray-300 mt-2">
            All surgical consumables and equipment from the shopping list have been procured.
            The patient is ready to proceed to surgery.
          </p>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: { name: string; quantity: number; status: string; category: string } }) {
  const isProcured = item.status.toLowerCase() === 'procured' || item.status.toLowerCase() === 'complete';
  
  return (
    <div className="px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        {isProcured ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <Clock className="h-5 w-5 text-orange-500" />
        )}
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-gray-400">
            {item.category} • Qty: {item.quantity}
          </p>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
        isProcured ? 'bg-green-600/30 text-green-300' : 'bg-orange-600/30 text-orange-300'
      }`}>
        {item.status}
      </span>
    </div>
  );
}
