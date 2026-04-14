func CalculatePrice(db *sql.DB, ezpinProduct *Product, link *Link, sku string) (float64, error) {
	// Early validation
	if ezpinProduct.MinPrice <= 0 {
		return 0, fmt.Errorf("invalid price for Ezpin SKU %s: %f", sku, ezpinProduct.MinPrice)
	}

	currency := ezpinProduct.Currency.Code

	// If there's a custom price from link, use it directly
	if link != nil && link.EzpinPrice != 0 {
		if currency == "USD" {
			return link.EzpinPrice, nil
		}
		rates, err := database.GetCurrencyRate(db)
		if err != nil {
			return 0, err
		}
		return link.EzpinPrice * rates[currency], nil
	}

	// Use product's MinPrice
	price := ezpinProduct.MinPrice

	// Convert to USD if needed
	if currency != "USD" {
		rates, err := database.GetCurrencyRate(db)
		if err != nil {
			return 0, err
		}
		price *= rates[currency]
	}

	return price, nil
}

// Alternative: If you need both original and USD prices
func CalculatePriceWithUSD(db *sql.DB, ezpinProduct *Product, link *Link, sku string) (price float64, priceInUSD float64, err error) {
	// Early validation
	if ezpinProduct.MinPrice <= 0 {
		return 0, 0, fmt.Errorf("invalid price for Ezpin SKU %s: %f", sku, ezpinProduct.MinPrice)
	}

	currency := ezpinProduct.Currency.Code
	rates, _ := database.GetCurrencyRate(db) // handle error as needed

	// Determine base price
	basePrice := ezpinProduct.MinPrice
	if link != nil && link.EzpinPrice != 0 {
		basePrice = link.EzpinPrice
	}

	// If already USD, no conversion needed
	if currency == "USD" {
		return basePrice, basePrice, nil
	}

	// Convert to USD
	convertedPrice := basePrice * rates[currency]
	return convertedPrice, convertedPrice, nil
}

// Minimal fix version (closest to original logic)
func CalculatePriceMinimal(db *sql.DB, ezpinProduct *Product, link *Link, sku string) (float64, float64, error) {
	rates, _ := database.GetCurrencyRate(db)
	currency := ezpinProduct.Currency.Code
	price := ezpinProduct.MinPrice

	if currency != "USD" {
		price *= rates[currency]
	}

	if link.EzpinPrice != 0 {
		if currency != "USD" {
			price = link.EzpinPrice * rates[currency]
		} else {
			price = link.EzpinPrice
		}
		priceInUSD := price // assuming conversion result is in USD
		return price, priceInUSD, nil
	}

	if ezpinProduct.MinPrice <= 0 {
		return 0, 0, fmt.Errorf("invalid price for Ezpin SKU %s: %f", sku, ezpinProduct.MinPrice)
	}

	priceInUSD := price // assuming converted price is in USD
	return price, priceInUSD, nil
}
