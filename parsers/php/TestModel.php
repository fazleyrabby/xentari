<?php

namespace App\Models;

class TestModel {
    public function items() {
        return $this->hasMany(Item::class);
    }

    public function owner() {
        return $this->belongsTo(User::class);
    }
}
