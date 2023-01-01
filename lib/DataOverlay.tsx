/**
* Copyright 2017-present Ampersand Technologies, Inc.
*/

import { Overlay } from 'data-store/dist/dataOverlay';
import * as DataStore from 'data-store/dist/dataStore';
import * as PropTypes from 'prop-types';
import * as React from 'react';

export const DataOverlayContext = React.createContext<DataStore.IDataStore>(DataStore);

export class DataOverlay extends React.Component<React.PropsWithChildren<{ dataStore?: Overlay }>, {}> {
  static contextType = DataOverlayContext;
  declare context: React.ContextType<typeof DataOverlayContext>;

  static readonly propTypes = {
    dataStore: PropTypes.object,
    children: PropTypes.element.isRequired,
  };

  private _overlay: Overlay;

  getOverlay() {
    return this._overlay;
  }

  componentWillMount() {
    this._overlay = this.props.dataStore ?? new Overlay(this.context);
  }

  componentWillUpdate(newProps) {
    if (this.props.dataStore !== newProps.dataStore) {
      console.error('The props of <DataOverlay> cannot be changed midrun');
    }
  }

  componentWillUnmount() {
    if (this._overlay && !this.props.dataStore) {
      this._overlay.uninit();
    }
  }

  render() {
    return (
      <DataOverlayContext.Provider value={this._overlay}>
        {this.props.children}
      </DataOverlayContext.Provider>
    );
  }
}
