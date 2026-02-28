import { DataPackage } from './dataPackage.interface';

export interface AddedEvent {
  data: DataPackage;
  origin: 'local' | 'network';
  timeStamp: string;
}

export interface RemoveEvent {
  data: DataPackage;
  origin: 'local' | 'network';
  timeStamp: string;
}

export interface SyncEvent {
  data: DataPackage;
  origin: 'local' | 'network';
  timeStamp: string;
}
