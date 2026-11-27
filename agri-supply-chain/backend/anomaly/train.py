"""Train and evaluate the synthetic rice baseline, then export trees for Node.js."""
import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import confusion_matrix, precision_score, recall_score

VERSION = "rice-synthetic-v1"
FEATURES = [
    ("Quantity", "kg", 1000, 9000, 5000, 1500),
    ("Harvest to registration", "days", 0, 10, 3, 1.5),
    ("Time with farmer", "days", 0, 7, 1.5, 1.2),
    ("Time with processor", "days", 0, 14, 4, 2.1),
    ("Time with distributor", "days", 0, 10, 2, 1.5),
]


def sample_normal(rng, features, count):
    return np.column_stack([
        rng.normal(mean, deviation, count).clip(low, high)
        for _, _, low, high, mean, deviation in features
    ])


def main():
    rng = np.random.default_rng(412)
    models = []
    for stage in range(4):
        features = FEATURES[:stage + 2]
        forest = IsolationForest(n_estimators=24, max_samples=64, random_state=41)
        forest.fit(sample_normal(rng, features, 1000))
        calibration = sample_normal(rng, features, 500)
        cutoff = float(np.quantile(-forest.score_samples(calibration), 0.97))
        normal = sample_normal(rng, features, 300)
        unusual = sample_normal(rng, features, 150)
        for row, values in enumerate(unusual):
            index = row % len(features)
            _, _, low, high, _, _ = features[index]
            values[index] = high + rng.uniform(0.25, 2) * (high - low)

        samples = np.vstack([normal, unusual])
        actual = np.repeat([0, 1], [len(normal), len(unusual)])
        predicted = -forest.score_samples(samples) > cutoff
        # Outside-range checks are applied alongside the model in the API.
        outside_range = np.any([
            (samples[:, index] < low) | (samples[:, index] > high)
            for index, (_, _, low, high, _, _) in enumerate(features)
        ], axis=0)
        combined = predicted | outside_range
        print(f"Stage {stage}: ML precision={precision_score(actual, predicted):.3f}, "
              f"recall={recall_score(actual, predicted):.3f}, "
              f"false positives={confusion_matrix(actual, predicted)[0, 1]}/{len(normal)}; "
              f"combined recall={recall_score(actual, combined):.3f}")

        trees = []
        for estimator in forest.estimators_:
            tree = estimator.tree_
            nodes = []
            for index, left in enumerate(tree.children_left):
                if left == -1:
                    nodes.append([int(tree.n_node_samples[index])])
                else:
                    nodes.append([int(tree.feature[index]), float(tree.threshold[index]),
                                  int(left), int(tree.children_right[index])])
            trees.append(nodes)
        models.append({
            "cutoff": cutoff,
            "features": [list(feature[:4]) for feature in features],
            "sampleSize": forest.max_samples_,
            "trees": trees,
        })

    path = Path(__file__).with_name("model.json")
    path.write_text(json.dumps({"version": VERSION, "stages": models}, separators=(",", ":")) + "\n",
                    encoding="utf-8")


if __name__ == "__main__":
    main()
