import { DataPackage } from './dataPackage.interface';

export interface AddedEvent {
  fileMeta: DataPackage;
  origin: 'local' | 'network';
  timeStamp: string;
}

export interface RemoveEvent {
  fileMeta: DataPackage;
  origin: 'local' | 'network';
  timeStamp: string;
}

export interface SyncEvent {
  fileMeta: DataPackage;
  origin: 'local' | 'network';
  timeStamp: string;
}
