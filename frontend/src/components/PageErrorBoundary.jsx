import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Catches render-time errors in a single dashboard so the rest of the app
 * stays usable. Shown while we rebuild legacy v1 pages onto the v2 schema.
 */
export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('PageErrorBoundary caught:', error, info);
  }
  reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 md:p-8">
          <div className="max-w-2xl mx-auto bg-white border border-amber-200 rounded-lg shadow-sm p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">This page is being rebuilt</h2>
                <p className="text-sm text-slate-600 mt-1">
                  It still references the v1 data shape. The backend moved to a new schema
                  in M1 and this view is on the M3 rewrite list.
                </p>
                <p className="text-xs text-slate-500 mt-3 font-mono break-all">
                  {String(this.state.error?.message || this.state.error)}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button onClick={this.reset} variant="outline">Retry</Button>
                  <Button onClick={() => (window.location.href = '/')} className="bg-slate-900 hover:bg-slate-800">
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
