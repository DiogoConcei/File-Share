import FileCatalog from '../FileCatalog';
import HashService from '../services/HashService';
import StorageService from '../services/StorageService';

const hasher = new HashService();
const storage = new StorageService();
const Catalog = new FileCatalog(hasher, storage);

export default Catalog;
