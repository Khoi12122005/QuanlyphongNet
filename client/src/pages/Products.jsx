import { useEffect, useState } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import { IoAdd, IoCafe, IoEllipsisHorizontal, IoFastFood, IoPencil, IoTrash, IoWarning } from 'react-icons/io5';

const API = '/api';

const formatCurrency = (val) => Number(val || 0).toLocaleString('vi-VN') + ' đ';
const CATEGORIES = ['Tất cả', 'Food', 'Drink', 'Other'];

const categoryEmojis = {
  Food: '🍜',
  Drink: '🥤',
  Other: '📦',
};

const categoryIcons = {
  Food: <IoFastFood />,
  Drink: <IoCafe />,
  Other: <IoEllipsisHorizontal />,
};

const categoryLabels = {
  Food: 'Đồ ăn',
  Drink: 'Đồ uống',
  Other: 'Khác',
};

const extractArray = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload[key])) return payload[key];
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
};

const toUiCategory = (category) => {
  const normalized = String(category || '').toLowerCase();
  if (normalized === 'food') return 'Food';
  if (normalized === 'drink') return 'Drink';
  return 'Other';
};

const toApiCategory = (category) => toUiCategory(category).toLowerCase();

const normalizeProduct = (product) => ({
  ...product,
  price: Number(product.price || 0),
  stock: Number(product.stock || 0),
  category: toUiCategory(product.category),
});

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('Tất cả');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    price: 0,
    category: 'Food',
    stock: 0,
    description: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/products`);
      setProducts(extractArray(res.data, 'products').map(normalizeProduct));
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'Tất cả' ? products : products.filter((p) => p.category === filter);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', price: 0, category: 'Food', stock: 0, description: '' });
    setShowModal(true);
  };

  const openEdit = (prod) => {
    setEditing(prod);
    setForm({
      name: prod.name || '',
      price: prod.price || 0,
      category: toUiCategory(prod.category),
      stock: prod.stock ?? 0,
      description: prod.description || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        category: toApiCategory(form.category),
      };

      if (editing) {
        await axios.put(`${API}/products/${editing.id}`, payload);
      } else {
        await axios.post(`${API}/products`, payload);
      }

      setShowModal(false);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi lưu sản phẩm');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
    try {
      await axios.delete(`${API}/products/${id}`);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi xóa');
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header page-header-actions">
        <div>
          <h1 className="page-title">Sản phẩm</h1>
          <p className="page-subtitle">{products.length} sản phẩm trong kho</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <IoAdd /> Thêm sản phẩm
        </button>
      </div>

      <div className="filter-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`filter-tab ${filter === cat ? 'active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat !== 'Tất cả' && <span style={{ marginRight: 4 }}>{categoryEmojis[cat]}</span>}
            {cat === 'Tất cả' ? cat : categoryLabels[cat]}
          </button>
        ))}
      </div>

      <div className="product-grid">
        {filtered.map((prod) => (
          <div key={prod.id} className="product-card">
            {prod.stock <= 5 && prod.stock > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  color: 'var(--accent-yellow)',
                  fontSize: '1rem',
                }}
                title="Sắp hết hàng"
              >
                <IoWarning />
              </div>
            )}
            {prod.stock === 0 && (
              <div style={{ position: 'absolute', top: 12, right: 12 }}>
                <span className="badge badge-red">Hết hàng</span>
              </div>
            )}

            <div className="product-card-emoji">{categoryEmojis[prod.category] || '📦'}</div>
            <div className="product-card-name">{prod.name}</div>
            <div className="product-card-price">{formatCurrency(prod.price)}</div>
            <div className={`product-card-stock ${prod.stock <= 5 ? 'low' : ''}`}>Kho: {prod.stock ?? 0} sản phẩm</div>
            <span
              className={`badge ${
                prod.category === 'Food' ? 'badge-yellow' : prod.category === 'Drink' ? 'badge-cyan' : 'badge-purple'
              }`}
              style={{ marginTop: 8 }}
            >
              {categoryIcons[prod.category]} <span style={{ marginLeft: 4 }}>{categoryLabels[prod.category] || 'Khác'}</span>
            </span>

            <div className="product-card-actions">
              <button className="btn btn-ghost btn-icon sm" onClick={() => openEdit(prod)} title="Sửa">
                <IoPencil />
              </button>
              <button className="btn btn-ghost btn-icon sm" onClick={() => handleDelete(prod.id)} title="Xóa">
                <IoTrash />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <p className="empty-state-text">Không tìm thấy sản phẩm nào</p>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}>
        <div className="form-group">
          <label className="form-label">Tên sản phẩm</label>
          <input
            type="text"
            className="form-input"
            placeholder="VD: Mì tôm, Coca Cola..."
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Giá (đ)</label>
            <input
              type="number"
              className="form-input"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Số lượng tồn</label>
            <input
              type="number"
              className="form-input"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Danh mục</label>
          <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="Food">🍜 Đồ ăn</option>
            <option value="Drink">🥤 Đồ uống</option>
            <option value="Other">📦 Khác</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Mô tả</label>
          <textarea
            className="form-textarea"
            placeholder="Mô tả sản phẩm (tùy chọn)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {editing ? 'Cập nhật' : 'Thêm mới'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
