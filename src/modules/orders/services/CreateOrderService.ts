import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer does not exists');
    }

    const allIds = products.map(product => ({
      id: product.id,
    }));
    const allProducts = await this.productsRepository.findAllById(allIds);
    const updateProducts: IUpdateProductsQuantityDTO[] = [];

    if (allIds.length !== allProducts.length) {
      throw new AppError('Product not found');
    }

    const order_products = allProducts.map(product => {
      const prodImp = products.find(prd => prd.id === product.id);
      const quantity = prodImp?.quantity || 0;
      const { price } = product;

      if (product.quantity - quantity < 0) {
        throw new AppError(
          `Insufficient inventory for product ${product.name}!`,
        );
      }

      updateProducts.push({
        id: product.id,
        quantity: product.quantity - quantity,
      });

      return {
        product_id: product.id,
        quantity,
        price,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: order_products,
    });

    delete order.customer_id;

    await this.productsRepository.updateQuantity(updateProducts);

    return order;
  }
}

export default CreateOrderService;
