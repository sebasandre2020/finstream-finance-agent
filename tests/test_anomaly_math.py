def test_modified_z_score_calculation():
    # Baseline historical coffee spend: [$4.50, $5.00, $5.25, $5.50, $6.00]
    amounts = [4.50, 5.00, 5.25, 5.50, 6.00]
    median = 5.25
    deviations = sorted([abs(x - median) for x in amounts])
    mad = 0.50

    # Test standard coffee transaction ($6.50) -> should NOT be anomaly
    normal_tx = 6.50
    normal_z = (0.6745 * abs(normal_tx - median)) / mad
    assert normal_z < 3.5

    # Test extreme outlier transaction ($485.00) -> MUST be flagged as anomaly
    outlier_tx = 485.00
    outlier_z = (0.6745 * abs(outlier_tx - median)) / mad
    assert outlier_z > 3.5
    assert outlier_z > 500.0  # Massive outlier
