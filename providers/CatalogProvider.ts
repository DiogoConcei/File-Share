import FileCatalog from '../core/FileCatalog';
import { storageService } from '../core/StorageService';
import HashService from '../services/HashService';

const hasher = new HashService();
const Catalog = new FileCatalog(hasher, storageService);

export default Catalog;
